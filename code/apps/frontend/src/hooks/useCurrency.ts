'use client'

import { useState, useEffect } from 'react'
import { getCurrencySymbol, setCurrencySymbol, CurrencySymbol } from '@/lib/currency'

export function useCurrency(): [CurrencySymbol, (s: CurrencySymbol) => void] {
  const [symbol, setSymbol] = useState<CurrencySymbol>('£')

  useEffect(() => {
    setSymbol(getCurrencySymbol())
  }, [])

  function change(s: CurrencySymbol) {
    setCurrencySymbol(s)
    setSymbol(s)
  }

  return [symbol, change]
}
