import type { Metadata } from 'next'
import './globals.css'
import { SidebarWrapper } from '@/components/sidebar-wrapper'

export const metadata: Metadata = {
  title: 'Personal Finance',
  description: 'Track your spending',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <div className="flex h-full overflow-hidden">
          <SidebarWrapper />
          <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
