'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'

type Message = { role: 'user' | 'assistant'; text: string }

type Context = {
  year: number
  month: number
  categories: Array<{
    name: string
    months: { label: string; total: number }[]
    monthlyBudget: number | null
    delta: number | null
  }>
}

type Props = {
  context: Context
  topMoverName: string | null
}

export function InsightsAIChat({ context, topMoverName }: Props) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chips = [
    topMoverName ? `Why did ${topMoverName} spike?` : 'Which category changed the most?',
    'Where can I cut back?',
    'Compare to last month',
  ]

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const { reply } = await api.insights.chat(text, context)
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setError("Couldn't reach AI — check your API key in Settings")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: '#f59e0b20', color: 'var(--accent)' }}
        >
          AI
        </span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Ask about your spending
        </span>
      </div>

      {/* Suggestion chips — only shown before first message */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-5 pt-4 pb-2">
          {chips.map(chip => (
            <button
              key={chip}
              onClick={() => send(chip)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
              style={{
                background: 'var(--surface-2)',
                border:     '1px solid var(--border)',
                color:      'var(--text-2)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm"
                style={
                  m.role === 'user'
                    ? { background: 'var(--accent)', color: '#0c0c0e', borderBottomRightRadius: 4 }
                    : { background: 'var(--surface-2)', color: 'var(--text)', borderBottomLeftRadius: 4 }
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="px-3.5 py-2.5 rounded-2xl text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderBottomLeftRadius: 4 }}
              >
                …
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="px-5 pb-2 text-xs" style={{ color: 'var(--red)' }}>{error}</p>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-5 py-3.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="Ask anything about your finances…"
          disabled={loading}
          className="flex-1 rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50"
          style={{
            background: 'var(--surface-2)',
            border:     '1px solid var(--border)',
            color:      'var(--text)',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0c0c0e', flexShrink: 0 }}
        >
          {loading ? (
            <span className="text-xs">…</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
