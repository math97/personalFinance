'use client'

import { useState } from 'react'
import { Menu, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sidebar } from './sidebar'
import { TransactionModal } from './transaction-modal'

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function openModal() {
    setMobileNavOpen(false)
    setModalOpen(true)
  }

  function closeNav() {
    setMobileNavOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar onAddClick={openModal} className="hidden h-screen md:flex" />

      <div className="fixed inset-x-0 top-0 z-40 border-b border-border bg-bg/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold text-text">Personal Finance</p>
            <p className="text-xs text-text-2">Track spending anywhere</p>
          </div>

          <button
            type="button"
            onClick={openModal}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-bg"
            aria-label="Add transaction"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden',
          mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeNav}
      >
        <div
          className={cn(
            'h-full max-w-[85vw] transition-transform',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          onClick={e => e.stopPropagation()}
        >
          <Sidebar
            onAddClick={openModal}
            onNavigate={closeNav}
            showMobileClose
            className="h-full shadow-2xl"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        {children}
      </main>

      {modalOpen && <TransactionModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
