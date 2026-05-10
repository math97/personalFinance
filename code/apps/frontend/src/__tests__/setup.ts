import '@testing-library/jest-dom'
import { vi } from 'vitest'
import messagesEn from '../../messages/en.json'

function resolvePath(obj: Record<string, any>, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const ns = namespace ? (messagesEn as Record<string, any>)[namespace] : messagesEn
    return (key: string, values?: Record<string, unknown>) => {
      const template = resolvePath(ns, key) ?? key
      if (!values) return template
      return template.replace(/\{(\w+)\}/g, (_: string, k: string) => String(values[k] ?? `{${k}}`))
    }
  },
  useLocale: () => 'en',
}))
