'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  BarChart3,
  CreditCard,
  Upload,
  Inbox,
  Tag,
  Settings,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: number
  disabled?: boolean
}

export function Sidebar({ onAddClick }: { onAddClick?: () => void }) {
  const pathname = usePathname()
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
    fetch(`${base}/import/batches`)
      .then(r => r.json())
      .then((batches: any[]) => setInboxCount(batches.length))
      .catch(() => {})
  }, [pathname]) // re-fetch when navigating

  const sections: { label: string; items: NavItem[] }[] = [
    {
      label: 'OVERVIEW',
      items: [
        { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
        { href: '/insights',     label: 'Insights',     icon: BarChart3       },
        { href: '/transactions', label: 'Transactions', icon: CreditCard      },
      ],
    },
    {
      label: 'IMPORT',
      items: [
        { href: '/import',       label: 'Upload Files', icon: Upload },
        { href: '/import/inbox', label: 'Import Inbox', icon: Inbox, badge: inboxCount || undefined },
      ],
    },
    {
      label: 'MANAGE',
      items: [
        { href: '/categories', label: 'Categories', icon: Tag },
        { href: '/settings',   label: 'Settings',   icon: Settings },
      ],
    },
  ]

  function isActive(href: string) {
    if (href === '/import/inbox') return pathname.startsWith('/import/inbox') || /^\/import\/[^/]+$/.test(pathname)
    if (href === '/import')      return pathname === '/import'
    if (href === '/dashboard')   return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col w-64 shrink-0 h-screen"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)', color: '#0c0c0e',
          }}
        >
          F
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Finance</p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>Personal tracker</p>
        </div>
      </div>

      {/* Add button */}
      {onAddClick && (
        <div className="px-3 mb-2">
          <button
            onClick={onAddClick}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}
          >
            + Add transaction
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-5">
        {sections.map(section => (
          <div key={section.label}>
            <p
              className="text-xs font-semibold tracking-wider px-2 mb-1"
              style={{ color: 'var(--text-3)' }}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.label}
                    href={item.disabled ? '#' : item.href}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: active ? 'var(--surface-2)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-2)',
                      pointerEvents: item.disabled ? 'none' : undefined,
                      opacity: item.disabled ? 0.4 : 1,
                    }}
                  >
                    <span style={{ color: active ? 'var(--accent)' : 'var(--text-2)', display: 'flex' }}>
                      <item.icon size={16} />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className="flex items-center justify-center text-xs font-bold"
                        style={{
                          width: 18, height: 18, borderRadius: 9,
                          background: 'var(--accent)', color: '#0c0c0e',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-center text-sm font-semibold shrink-0"
          style={{
            width: 32, height: 32, borderRadius: 16,
            background: 'var(--surface-2)', color: 'var(--text)',
          }}
        >
          M
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>Matheus</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>math.albuquerque97@gmail.com</p>
        </div>
      </div>
    </aside>
  )
}
