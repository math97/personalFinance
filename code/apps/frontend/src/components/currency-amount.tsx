'use client'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/cn'

interface CurrencyAmountProps extends React.ComponentProps<'span'> {
  amount: number
  fractionDigits?: number
}

export function CurrencyAmount({ amount, fractionDigits = 2, className, ...props }: CurrencyAmountProps) {
  const [currency] = useCurrency()
  return (
    <span className={cn(className)} {...props}>
      {currency}{Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}
    </span>
  )
}
