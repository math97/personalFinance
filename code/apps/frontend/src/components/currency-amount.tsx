'use client'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/cn'
import { useLocale } from 'next-intl'

interface CurrencyAmountProps extends React.ComponentProps<'span'> {
  amount: number
  fractionDigits?: number
}

export function CurrencyAmount({ amount, fractionDigits = 2, className, ...props }: CurrencyAmountProps) {
  const [currency] = useCurrency()
  const locale = useLocale()
  const localeString = locale === 'pt-BR' ? 'pt-BR' : 'en-GB'
  return (
    <span className={cn(className)} {...props}>
      {currency}{Math.abs(amount).toLocaleString(localeString, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}
    </span>
  )
}
