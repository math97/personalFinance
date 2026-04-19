export type Category = {
  id: string
  name: string
  color: string
}

export type Transaction = {
  id: string
  date: string
  description: string
  amount: number
  category: Category | null
  source: 'manual' | 'pdf' | 'photo'
}

export type ImportedTx = {
  id: string
  rawDate: string
  rawDescription: string
  rawAmount: number
  aiCategorized: boolean
  category: Category | null
}

export type ImportBatch = {
  id: string
  filename: string
  uploadedAt: string
  txCount: number
}

export type CategoryRule = {
  id: string
  keyword: string
}

export type CategoryWithRules = Category & {
  rules: CategoryRule[]
  txCount: number
}

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Groceries',     color: '#34d399' },
  { id: 'cat-2', name: 'Restaurants',   color: '#fb923c' },
  { id: 'cat-3', name: 'Transport',     color: '#38bdf8' },
  { id: 'cat-4', name: 'Subscriptions', color: '#c084fc' },
  { id: 'cat-5', name: 'Rent',          color: '#818cf8' },
  { id: 'cat-6', name: 'Health',        color: '#2dd4bf' },
  { id: 'cat-7', name: 'Shopping',      color: '#f472b6' },
  { id: 'cat-8', name: 'Other',         color: '#6b7280' },
]

const [GROCERIES, RESTAURANTS, TRANSPORT, SUBSCRIPTIONS, RENT, HEALTH, SHOPPING, OTHER] = MOCK_CATEGORIES

export const MOCK_TRANSACTIONS: Transaction[] = [
  // April 2026
  { id: 'tx-01', date: '2026-04-18', description: 'Tesco Metro',           amount: -34.20, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-02', date: '2026-04-17', description: 'Barclays Rent',         amount: -1200,  category: RENT,          source: 'manual' },
  { id: 'tx-03', date: '2026-04-16', description: 'Uber Trip',             amount: -18.40, category: TRANSPORT,     source: 'pdf'    },
  { id: 'tx-04', date: '2026-04-15', description: 'Dishoom London',        amount: -67.50, category: RESTAURANTS,   source: 'pdf'    },
  { id: 'tx-05', date: '2026-04-14', description: 'Spotify Premium',       amount: -9.99,  category: SUBSCRIPTIONS, source: 'manual' },
  { id: 'tx-06', date: '2026-04-13', description: 'Sainsbury\'s',          amount: -52.10, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-07', date: '2026-04-12', description: 'TfL Oyster Top-Up',    amount: -30.00, category: TRANSPORT,     source: 'manual' },
  { id: 'tx-08', date: '2026-04-11', description: 'ZARA Online',           amount: -89.95, category: SHOPPING,      source: 'photo'  },
  { id: 'tx-09', date: '2026-04-10', description: 'Netflix',               amount: -15.99, category: SUBSCRIPTIONS, source: 'manual' },
  { id: 'tx-10', date: '2026-04-09', description: 'Boots Pharmacy',        amount: -23.40, category: HEALTH,        source: 'pdf'    },
  { id: 'tx-11', date: '2026-04-08', description: 'Pret A Manger',        amount: -12.80, category: RESTAURANTS,   source: 'pdf'    },
  { id: 'tx-12', date: '2026-04-07', description: 'Waitrose',              amount: -78.30, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-13', date: '2026-04-06', description: 'Amazon Prime',          amount: -8.99,  category: SUBSCRIPTIONS, source: 'manual' },
  { id: 'tx-14', date: '2026-04-05', description: 'City Gym Membership',   amount: -45.00, category: HEALTH,        source: 'manual' },
  { id: 'tx-15', date: '2026-04-04', description: 'Deliveroo',             amount: -31.20, category: RESTAURANTS,   source: 'photo'  },
  { id: 'tx-16', date: '2026-04-03', description: 'H&M',                  amount: -54.00, category: SHOPPING,      source: 'manual' },
  { id: 'tx-17', date: '2026-04-02', description: 'EasyJet Baggage',       amount: -22.00, category: TRANSPORT,     source: 'pdf'    },
  { id: 'tx-18', date: '2026-04-01', description: 'Lidl',                  amount: -41.60, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-19', date: '2026-04-01', description: 'Adobe Creative Cloud',  amount: -54.99, category: SUBSCRIPTIONS, source: 'manual' },
  { id: 'tx-20', date: '2026-04-01', description: 'Council Tax',           amount: -180.00,category: OTHER,         source: 'manual' },
  // March 2026
  { id: 'tx-21', date: '2026-03-31', description: 'Barclays Rent',         amount: -1200,  category: RENT,          source: 'manual' },
  { id: 'tx-22', date: '2026-03-28', description: 'Tesco Extra',           amount: -67.40, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-23', date: '2026-03-25', description: 'Uber Trip',             amount: -14.20, category: TRANSPORT,     source: 'pdf'    },
  { id: 'tx-24', date: '2026-03-22', description: 'Nobu London',           amount: -120.00,category: RESTAURANTS,   source: 'manual' },
  { id: 'tx-25', date: '2026-03-20', description: 'Spotify Premium',       amount: -9.99,  category: SUBSCRIPTIONS, source: 'manual' },
  { id: 'tx-26', date: '2026-03-18', description: 'Sainsbury\'s',          amount: -48.90, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-27', date: '2026-03-15', description: 'TfL Oyster',            amount: -30.00, category: TRANSPORT,     source: 'manual' },
  // February 2026
  { id: 'tx-28', date: '2026-02-28', description: 'Barclays Rent',         amount: -1200,  category: RENT,          source: 'manual' },
  { id: 'tx-29', date: '2026-02-20', description: 'Tesco Metro',           amount: -29.50, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-30', date: '2026-02-14', description: 'Hawksmoor',             amount: -145.00,category: RESTAURANTS,   source: 'manual' },
  // January 2026
  { id: 'tx-31', date: '2026-01-31', description: 'Barclays Rent',         amount: -1200,  category: RENT,          source: 'manual' },
  { id: 'tx-32', date: '2026-01-15', description: 'Tesco Metro',           amount: -55.20, category: GROCERIES,     source: 'pdf'    },
  { id: 'tx-33', date: '2026-01-10', description: 'Wagamama',              amount: -38.50, category: RESTAURANTS,   source: 'manual' },
]

export const MOCK_BATCHES: ImportBatch[] = [
  { id: 'batch-1', filename: 'barclays-april-2026.pdf',  uploadedAt: '2026-04-18', txCount: 12 },
  { id: 'batch-2', filename: 'receipt-dishoom-0416.jpg', uploadedAt: '2026-04-16', txCount:  3 },
]

export const MOCK_IMPORTED_TXS: ImportedTx[] = [
  { id: 'itx-01', rawDate: '2026-04-01', rawDescription: 'TESCO METRO LONDON',       rawAmount: -34.20, aiCategorized: true,  category: GROCERIES   },
  { id: 'itx-02', rawDate: '2026-04-02', rawDescription: 'UBER * TRIP',              rawAmount: -12.40, aiCategorized: true,  category: TRANSPORT   },
  { id: 'itx-03', rawDate: '2026-04-03', rawDescription: 'SPOTIFY',                  rawAmount: -9.99,  aiCategorized: true,  category: SUBSCRIPTIONS},
  { id: 'itx-04', rawDate: '2026-04-04', rawDescription: 'AMZN MKTP GB',             rawAmount: -24.99, aiCategorized: false, category: null        },
  { id: 'itx-05', rawDate: '2026-04-05', rawDescription: 'PRET A MANGER',            rawAmount: -8.50,  aiCategorized: true,  category: RESTAURANTS },
  { id: 'itx-06', rawDate: '2026-04-06', rawDescription: 'TFL TRAVEL',               rawAmount: -30.00, aiCategorized: true,  category: TRANSPORT   },
  { id: 'itx-07', rawDate: '2026-04-07', rawDescription: 'NETFLIX.COM',              rawAmount: -15.99, aiCategorized: true,  category: SUBSCRIPTIONS},
  { id: 'itx-08', rawDate: '2026-04-08', rawDescription: 'BOOTS PHARMA',             rawAmount: -18.70, aiCategorized: true,  category: HEALTH      },
  { id: 'itx-09', rawDate: '2026-04-09', rawDescription: 'SAINSBURYS',               rawAmount: -62.40, aiCategorized: true,  category: GROCERIES   },
  { id: 'itx-10', rawDate: '2026-04-10', rawDescription: 'GYM KINGDOM LTD',          rawAmount: -45.00, aiCategorized: false, category: null        },
  { id: 'itx-11', rawDate: '2026-04-11', rawDescription: 'DELIVEROO',                rawAmount: -27.80, aiCategorized: true,  category: RESTAURANTS },
  { id: 'itx-12', rawDate: '2026-04-12', rawDescription: 'ADOBE SYSTEMS',            rawAmount: -54.99, aiCategorized: true,  category: SUBSCRIPTIONS},
]

export const MOCK_CATEGORIES_WITH_RULES: CategoryWithRules[] = [
  {
    ...GROCERIES,
    txCount: 8,
    rules: [
      { id: 'r-01', keyword: 'tesco' },
      { id: 'r-02', keyword: 'sainsbury' },
      { id: 'r-03', keyword: 'waitrose' },
      { id: 'r-04', keyword: 'lidl' },
    ],
  },
  {
    ...RESTAURANTS,
    txCount: 5,
    rules: [
      { id: 'r-05', keyword: 'pret' },
      { id: 'r-06', keyword: 'deliveroo' },
      { id: 'r-07', keyword: 'dishoom' },
    ],
  },
  {
    ...TRANSPORT,
    txCount: 6,
    rules: [
      { id: 'r-08', keyword: 'uber' },
      { id: 'r-09', keyword: 'tfl' },
      { id: 'r-10', keyword: 'oyster' },
    ],
  },
  {
    ...SUBSCRIPTIONS,
    txCount: 5,
    rules: [
      { id: 'r-11', keyword: 'spotify' },
      { id: 'r-12', keyword: 'netflix' },
      { id: 'r-13', keyword: 'amazon prime' },
      { id: 'r-14', keyword: 'adobe' },
    ],
  },
  {
    ...RENT,
    txCount: 4,
    rules: [
      { id: 'r-15', keyword: 'barclays rent' },
      { id: 'r-16', keyword: 'landlord' },
    ],
  },
  {
    ...HEALTH,
    txCount: 3,
    rules: [
      { id: 'r-17', keyword: 'boots' },
      { id: 'r-18', keyword: 'gym' },
      { id: 'r-19', keyword: 'pharmacy' },
    ],
  },
  {
    ...SHOPPING,
    txCount: 2,
    rules: [],
  },
  {
    ...OTHER,
    txCount: 1,
    rules: [],
  },
]

export function getTransactionsByMonth(year: number, month: number): Transaction[] {
  return MOCK_TRANSACTIONS.filter(tx => {
    const d = new Date(tx.date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
}

export function getMonthlyTotal(year: number, month: number): number {
  return getTransactionsByMonth(year, month).reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
}

export function getSpendingByCategory(year: number, month: number) {
  const txs = getTransactionsByMonth(year, month)
  const map = new Map<string, { name: string; color: string; total: number }>()

  for (const tx of txs) {
    const key = tx.category?.id ?? 'uncategorized'
    const name = tx.category?.name ?? 'Uncategorized'
    const color = tx.category?.color ?? '#6b7280'
    const existing = map.get(key)
    if (existing) {
      existing.total += Math.abs(tx.amount)
    } else {
      map.set(key, { name, color, total: Math.abs(tx.amount) })
    }
  }

  return [...map.values()].sort((a, b) => b.total - a.total)
}
