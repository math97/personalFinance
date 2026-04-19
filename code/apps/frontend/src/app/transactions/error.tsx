'use client'

import { PageError } from '@/components/error-boundary'

export default function TransactionsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} />
}
