'use client'

import { TERMS, TermKey } from '@/lib/terminology'

interface TermPopoverProps {
  term: TermKey
}

export function TermPopover({ term }: TermPopoverProps) {
  const t = TERMS[term]
  return (
    <div
      className="absolute left-0 bottom-full z-50 mb-1.5 w-[220px] rounded-lg border border-border-2 bg-surface-2 p-3"
      style={{ boxShadow: '0 4px 16px #00000066' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-text">{t.label}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
          style={{ background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b30' }}
        >
          {t.technical}
        </span>
      </div>
      <div className="mb-0 h-px bg-border" />
      <p className="mt-2 text-xs leading-relaxed text-text-2">{t.description}</p>
    </div>
  )
}