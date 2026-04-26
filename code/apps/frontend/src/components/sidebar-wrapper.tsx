'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, CreditCard, Inbox, LayoutDashboard, Plus, Settings, Tag, Upload, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sidebar } from './sidebar'
import { TransactionModal } from './transaction-modal'

type MobileNavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const primaryMobileItems: MobileNavItem[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Txs', icon: CreditCard },
  { href: '/import', label: 'Import', icon: Upload },
]

const moreItems: Array<MobileNavItem & { badge?: number }> = [
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/import/inbox', label: 'Import Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function getMobileTitle(pathname: string) {
  if (pathname.startsWith('/transactions')) return 'Transactions'
  if (pathname.startsWith('/import/inbox')) return 'Import Inbox'
  if (/^\/import\/[^/]+$/.test(pathname)) return 'Batch Review'
  if (pathname.startsWith('/import')) return 'Upload Files'
  if (pathname.startsWith('/categories')) return 'Categories'
  if (pathname.startsWith('/insights')) return 'Insights'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Dashboard'
}

function isRouteActive(pathname: string, href: string) {
  if (href === '/import/inbox') return pathname.startsWith('/import/inbox')
  if (href === '/import') return pathname === '/import' || (/^\/import\/[^/]+$/.test(pathname) && !pathname.startsWith('/import/inbox'))
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [inboxCount, setInboxCount] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    fetch(`${base}/import/batches`)
      .then(r => r.json())
      .then((batches: any[]) => setInboxCount(batches.length))
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const title = getMobileTitle(pathname)
  const moreBadge = pathname.startsWith('/import/inbox') ? inboxCount || undefined : undefined

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar onAddClick={() => setModalOpen(true)} inboxCount={inboxCount} className="hidden md:flex" />

      <div className="fixed inset-x-0 top-0 z-40 border-b border-border bg-bg/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-bg">
              F
            </div>
            <p className="text-sm font-semibold text-text">{title}</p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-bg pt-16 pb-24 md:pt-0 md:pb-0">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-2">
          {primaryMobileItems.map(item => {
            const active = isRouteActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                  active ? 'bg-accent-dim text-accent' : 'text-text-2',
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
              pathname.startsWith('/categories') || pathname.startsWith('/insights') || pathname.startsWith('/settings') || pathname.startsWith('/import/inbox')
                ? 'bg-accent-dim text-accent'
                : 'text-text-2',
            )}
          >
            <BarChart3 size={18} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={e => {
            if (e.target === e.currentTarget) setMoreOpen(false)
          }}
        >
          <div className="absolute inset-x-3 bottom-20 rounded-3xl border border-border-2 bg-surface p-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-border-2" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text">More</h2>
                <p className="text-xs text-text-2">Secondary screens and settings</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="rounded-lg p-2 text-text-2">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {moreItems.map(item => {
                const active = isRouteActive(pathname, item.href)
                const badge = item.href === '/import/inbox' ? moreBadge : undefined

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors',
                      active
                        ? 'border-accent/30 bg-accent-dim text-text'
                        : 'border-border bg-surface-2 text-text',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={16} className={active ? 'text-accent' : 'text-text-2'} />
                      <span className="font-medium">{item.label}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {badge ? (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg">
                          {badge}
                        </span>
                      ) : null}
                      <span className="text-text-3">›</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {modalOpen && <TransactionModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
