export const CURRENCIES = [
  { symbol: '£', label: 'GBP' },
  { symbol: '€', label: 'Euro' },
  { symbol: '$', label: 'Dollar' },
  { symbol: 'R$', label: 'Real' },
] as const

export type CurrencySymbol = typeof CURRENCIES[number]['symbol']

const STORAGE_KEY = 'finance:currency'
const DEFAULT: CurrencySymbol = '£'

export function getCurrencySymbol(): CurrencySymbol {
  if (typeof window === 'undefined') return DEFAULT
  return (localStorage.getItem(STORAGE_KEY) as CurrencySymbol) ?? DEFAULT
}

export function setCurrencySymbol(symbol: CurrencySymbol): void {
  localStorage.setItem(STORAGE_KEY, symbol)
}
