'use client'

import { useEffect, useRef, useState } from 'react'
import { TermPopover } from './term-popover'
import { TermKey } from '@/lib/terminology'

interface InfoIconProps {
  term: TermKey
}

export function InfoIcon({ term }: InfoIconProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Learn more"
        className="ml-1.5 inline-flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors"
        style={{
          border: `1px solid ${open ? '#f59e0b' : 'var(--text-3)'}`,
          background: open ? '#f59e0b18' : 'transparent',
          color: open ? '#f59e0b' : 'var(--text-3)',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, fontFamily: 'Inter, sans-serif' }}>i</span>
      </button>
      {open && <TermPopover term={term} onClose={() => setOpen(false)} />}
    </span>
  )
}