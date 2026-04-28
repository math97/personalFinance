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
    <span
      ref={wrapRef}
      className="relative inline-flex items-center"
      style={{ verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Learn more"
        className="ml-1.5 inline-flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors"
        style={{
          border: `1px solid ${open ? '#f59e0b' : 'var(--text-3)'}`,
          background: open ? '#f59e0b18' : 'transparent',
          color: open ? '#f59e0b' : 'var(--text-3)',
          flexShrink: 0,
          position: 'relative',
          top: '-1px',
        }}
      >
        <span style={{ fontSize: 8, fontWeight: 900, lineHeight: 1, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>i</span>
      </button>
      {open && <TermPopover term={term} />}
    </span>
  )
}