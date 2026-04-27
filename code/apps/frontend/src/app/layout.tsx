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
        <SidebarWrapper>{children}</SidebarWrapper>
      </body>
    </html>
  )
}
