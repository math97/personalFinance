'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Sparkles, CloudUpload, PenLine, FileText, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useCurrency } from '@/hooks/useCurrency'

type Step = 'picker' | 'manual' | 'batch'

type QueuedFile = { file: File; id: string }

export function TransactionModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('picker')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {step === 'picker' && (
        <PickerStep onSelect={setStep} onClose={onClose} />
      )}
      {step === 'manual' && (
        <ManualStep onClose={onClose} onBack={() => setStep('picker')} />
      )}
      {step === 'batch' && (
        <BatchStep onClose={onClose} onBack={() => setStep('picker')} />
      )}
    </div>
  )
}

function PickerStep({ onSelect, onClose }: { onSelect: (s: Step) => void; onClose: () => void }) {
  const [hovered, setHovered] = useState<'manual' | 'batch' | null>('manual')

  const cards = [
    {
      id: 'manual' as const,
      icon: PenLine,
      title: 'Add manually',
      desc: 'Enter amount, description and date by hand',
    },
    {
      id: 'batch' as const,
      icon: CloudUpload,
      title: 'Upload documents',
      desc: 'Drop PDFs or photos — Claude extracts transactions automatically',
    },
  ]

  return (
    <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-surface border border-border-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">Add transaction</h2>
        <button onClick={onClose} className="text-text-2"><X size={18} /></button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => onSelect(card.id)}
            onMouseEnter={() => setHovered(card.id)}
            onMouseLeave={() => setHovered(null)}
            className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all bg-surface-2"
            style={{
              border: `1.5px solid ${hovered === card.id ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <card.icon
              size={20}
              className={cn(hovered === card.id ? 'text-accent' : 'text-text-2')}
            />
            <p className="text-sm font-medium text-text">{card.title}</p>
            <p className="text-xs leading-relaxed text-text-2">{card.desc}</p>
          </button>
        ))}
      </div>

      <button
        onClick={onClose}
        className="w-full py-2 rounded-lg text-sm transition-colors bg-surface-2 text-text-2 border border-border"
      >
        Cancel
      </button>
    </div>
  )
}

function ManualStep({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const [currency] = useCurrency()
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amountFocused, setAmountFocused] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0], categoryId: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.categories.list().then(setCategories).catch(() => {}) }, [])

  async function handleSubmit() {
    if (!form.amount || !form.description) return
    setLoading(true)
    await api.transactions.create({
      amount: type === 'expense' ? -Math.abs(Number(form.amount)) : Math.abs(Number(form.amount)),
      date: form.date,
      description: form.description,
      categoryId: type === 'expense' ? (form.categoryId || undefined) : undefined,
      source: 'manual',
    })
    setLoading(false)
    window.dispatchEvent(new CustomEvent('transaction-saved'))
    onClose()
  }

  const accentColor = type === 'income' ? 'var(--green)' : 'var(--accent)'

  return (
    <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border-2 bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-text">Add transaction</h2>
        <button onClick={onClose} className="text-text-2"><X size={18} /></button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-4">
        {/* Type toggle */}
        <div className="flex gap-0.5 rounded-lg p-0.5 bg-surface-2">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all"
              style={{
                background: type === t ? 'var(--bg)' : 'transparent',
                color: type === t ? (t === 'income' ? 'var(--green)' : 'var(--text)') : 'var(--text-2)',
                border: type === t ? '1px solid var(--border-2)' : '1px solid transparent',
              }}
            >
              {t === 'expense' ? 'Spending' : 'Income'}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-medium mb-1.5 block text-text-2">Amount</label>
          <div
            className="flex items-center rounded-lg px-3 py-2.5 transition-all bg-surface-2"
            style={{
              border: `1.5px solid ${amountFocused ? accentColor : 'var(--border-2)'}`,
            }}
          >
            <span className="text-sm mr-1 text-text-2">{currency}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              className="flex-1 bg-transparent text-sm outline-none text-text"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium mb-1.5 block text-text-2">Description</label>
          <input
            type="text"
            placeholder={type === 'income' ? 'e.g. Rent contribution' : 'e.g. Tesco Metro'}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all bg-surface-2 border border-border-2 text-text"
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-medium mb-1.5 block text-text-2">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none bg-surface-2 border border-border-2 text-text"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        {/* Category + rule hint — expenses only */}
        {type === 'expense' && (
          <>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-text-2">Category</label>
              <select
                value={form.categoryId}
                onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none bg-surface-2 border border-border-2 text-text"
              >
                <option value="">— none —</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-accent-dim border border-accent/10">
              <Sparkles size={14} className="text-accent mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed text-accent">
                Keyword rules will auto-categorize matching transactions going forward
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors bg-surface-2 text-text-2 border border-border"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !form.amount || !form.description}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ background: accentColor, color: '#0c0c0e' }}
        >
          {loading ? 'Saving…' : type === 'income' ? 'Add Income' : 'Add Spending'}
        </button>
      </div>
    </div>
  )
}

function BatchStep({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [
      ...prev,
      ...accepted.map(f => ({ file: f, id: Math.random().toString(36).slice(2) })),
    ])
  }, [])

  async function handleUpload() {
    setUploading(true)
    setError(null)
    try {
      for (const { file } of files) {
        const res = await api.import.upload(file)
        if (!res.batchId) throw new Error(`Failed to process ${file.name}`)
      }
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
    },
    multiple: true,
  })

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  return (
    <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-2 bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-text">Upload documents</h2>
        <button onClick={onClose} className="text-text-2"><X size={18} /></button>
      </div>

      {/* Body */}
      <div className="px-5 py-5 space-y-3">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className="rounded-xl text-center cursor-pointer transition-all py-8"
          style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border-2)'}`,
            background: isDragActive ? 'var(--accent-dim)' : 'var(--surface-2)',
          }}
        >
          <input {...getInputProps()} />
          <CloudUpload size={24} className="mx-auto mb-2 text-text-2" />
          <p className="text-sm font-medium mb-1 text-text">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-text-2">
            PDF, JPG, PNG, HEIC
          </p>
        </div>

        {/* File queue */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map(({ file, id }) => (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-border"
              >
                <FileText size={16} className="text-text-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-text">{file.name}</p>
                  <p className="text-xs text-text-2">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button onClick={() => removeFile(id)} className="text-red">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI hint */}
        <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-accent-dim border border-accent/10">
          <Sparkles size={14} className="text-accent mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-accent">
            Claude will extract and auto-categorize transactions from each file
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {error
          ? <p className="text-xs text-red">{error}</p>
          : <p className="text-xs text-text-2">
              {files.length > 0
                ? `${files.length} file${files.length > 1 ? 's' : ''} · ${files.length} batch${files.length > 1 ? 'es' : ''}`
                : 'No files selected'}
            </p>
        }
        <div className="flex gap-2 sm:justify-end">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm transition-colors bg-surface-2 text-text-2 border border-border"
          >
            Back
          </button>
          <button
            disabled={files.length === 0 || uploading}
            onClick={handleUpload}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 bg-accent text-bg"
          >
            {uploading ? 'Uploading…' : 'Upload & extract'}
          </button>
        </div>
      </div>
    </div>
  )
}
