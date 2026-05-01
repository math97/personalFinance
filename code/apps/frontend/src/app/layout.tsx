import type { Metadata } from 'next'
import './globals.css'
import { SidebarWrapper } from '@/components/sidebar-wrapper'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Ember',
  description: 'Every ember grows into fire',
  icons: { icon: '/ember-icon.png' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} className="h-full">
      <body className="h-full">
        <NextIntlClientProvider messages={messages}>
          <SidebarWrapper>{children}</SidebarWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
