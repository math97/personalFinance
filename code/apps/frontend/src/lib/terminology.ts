export const TERMS = {
  moneyOut: {
    label: 'Money Out',
    technical: 'Outflow',
    description: 'Total money leaving your account this period — what you spent.',
  },
  saved: {
    label: 'Saved',
    technical: 'Net Cash Flow',
    description: 'What remains after all spending. Positive means you saved money.',
  },
  availableNow: {
    label: 'Available Now',
    technical: 'Liquidity',
    description: 'Your balance minus known upcoming expenses this period.',
  },
  dueSoon: {
    label: 'Due Soon',
    technical: 'Committed Outflows',
    description: 'Recurring expenses expected before the end of this period.',
  },
  spending: {
    label: 'Spending',
    technical: 'Expenditure',
    description: 'Any money leaving your account, grouped for analysis.',
  },
  whereItGoes: {
    label: 'Where it Goes',
    technical: 'Expenditure Breakdown',
    description: 'Your outflows grouped by category.',
  },
  overLimit: {
    label: 'Over limit',
    technical: 'Budget Variance',
    description: 'Amount spent beyond your set limit for this category.',
  },
} as const

export type TermKey = keyof typeof TERMS