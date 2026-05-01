'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
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
  labelKey: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: number
  disabled?: boolean
}

interface SidebarProps extends React.ComponentProps<'aside'> {
  onAddClick?: () => void
  inboxCount?: number
}

export function Sidebar({ onAddClick, inboxCount = 0, className, ...props }: SidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('sidebar')

  const sections: { labelKey: string; items: NavItem[] }[] = [
    {
      labelKey: 'overview',
      items: [
        { href: '/dashboard',    labelKey: 'dashboard',    icon: LayoutDashboard },
        { href: '/insights',     labelKey: 'insights',     icon: BarChart3       },
        { href: '/transactions', labelKey: 'transactions', icon: CreditCard      },
      ],
    },
    {
      labelKey: 'import',
      items: [
        { href: '/import',       labelKey: 'uploadFiles',  icon: Upload },
        { href: '/import/inbox', labelKey: 'importInbox',  icon: Inbox, badge: inboxCount || undefined },
      ],
    },
    {
      labelKey: 'manage',
      items: [
        { href: '/categories', labelKey: 'categories', icon: Tag },
        { href: '/settings',   labelKey: 'settings',   icon: Settings },
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
    <aside className={cn('flex h-screen w-64 shrink-0 flex-col border-r border-border bg-surface', className)} {...props}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0 bg-accent text-bg">
          🔥
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Ember</p>
          <p className="text-xs text-text-2">Every ember grows</p>
        </div>
      </div>

      {/* Add button */}
      {onAddClick && (
        <div className="px-3 mb-2">
          <button
            onClick={onAddClick}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-accent text-bg"
          >
            {t('addTransaction')}
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-5">
        {sections.map(section => (
          <div key={section.labelKey}>
            <p className="text-xs font-semibold tracking-wider px-2 mb-1 text-text-3">
              {t(section.labelKey)}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.labelKey}
                    href={item.disabled ? '#' : item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                      active ? 'bg-surface-2 text-text' : 'text-text-2',
                      item.disabled && 'pointer-events-none opacity-40',
                    )}
                  >
                    <span className={cn('flex', active ? 'text-accent' : 'text-text-2')}>
                      <item.icon size={16} />
                    </span>
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {item.badge && (
                      <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full text-xs font-bold bg-accent text-bg">
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
      <div className="flex items-center gap-3 px-4 py-4 border-t border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 bg-surface-2 text-text">
          M
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-text">Matheus</p>
          <p className="text-xs truncate text-text-2">math.albuquerque97@gmail.com</p>
        </div>
      </div>
    </aside>
  )
}
