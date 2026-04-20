'use client'
import { useCurrency } from '@/hooks/useCurrency'

export function CurrencyAmount({
  amount,
  className,
  fractionDigits = 2,
}: {
  amount: number
  className?: string
  fractionDigits?: number
}) {
  const [currency] = useCurrency()
  return (
    <span className={className}>
      {currency}{Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}
    </span>
  )
}
