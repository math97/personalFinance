'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

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
    <div className="rounded-xl overflow-hidden bg-surface border border-border">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-dim text-accent">
          AI
        </span>
        <span className="text-sm font-semibold text-text">
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
              className="text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 bg-surface-2 border border-border text-text-2"
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
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm',
                  m.role === 'user'
                    ? 'bg-accent text-bg rounded-br-sm'
                    : 'bg-surface-2 text-text rounded-bl-sm',
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm bg-surface-2 text-text-2">
                …
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="px-5 pb-2 text-xs text-red">{error}</p>
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
          className="flex-1 rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50 bg-surface-2 border border-border text-text"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-40 shrink-0 bg-accent text-bg"
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
