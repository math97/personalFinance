'use client'

import { AlertTriangle } from 'lucide-react'

export function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div
        className="flex items-center justify-center w-12 h-12 rounded-full"
        style={{ background: 'var(--surface-2)' }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--text-2)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Something went wrong</p>
        <p className="text-xs" style={{ color: 'var(--text-2)' }}>
          {error.message || 'An unexpected error occurred'}
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        Try again
      </button>
    </div>
  )
}
