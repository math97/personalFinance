import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED = ['pt-BR', 'en'] as const

export default getRequestConfig(async () => {
  const raw = (await cookies()).get('finance_locale')?.value ?? 'en'
  const locale = SUPPORTED.includes(raw as typeof SUPPORTED[number]) ? raw : 'en'
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
