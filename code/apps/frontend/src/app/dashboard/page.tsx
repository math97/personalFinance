import Link from 'next/link'
import { MonthComparisonChart } from '@/components/month-comparison-chart'
import { SpendingSection } from '@/components/spending-section'
import { CurrencyAmount } from '@/components/currency-amount'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, PlusCircle, Upload } from 'lucide-react'

function CategoryPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + '22', color }}>
      {name}
    </span>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function EmptyDashboard({ monthLabel, year, month }: { monthLabel: string; year: number; month: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <PlusCircle size={24} style={{ color: 'var(--text-3)' }} />
      </div>
      <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
        No transactions in {monthLabel}
      </h2>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Add transactions manually or upload a bank statement to get started.
      </p>
      <div className="flex gap-3">
        <Link
          href="/import"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <Upload size={14} /> Upload statement
        </Link>
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const rawYear  = Number(params.year)
  const rawMonth = Number(params.month)
  const year  = Number.isFinite(rawYear)  && rawYear  > 2000 && rawYear  < 2100 ? rawYear  : now.getFullYear()
  const month = Number.isFinite(rawMonth) && rawMonth >= 1   && rawMonth <= 12  ? rawMonth : now.getMonth() + 1

  const prevMonth = month === 1  ? 12 : month - 1
  const prevYear  = month === 1  ? year - 1 : year
  const nextMonth = month === 12 ? 1  : month + 1
  const nextYear  = month === 12 ? year + 1 : year

  const [{ summary, byCategory, monthlyTotals }, { items: recentTxs }, prevSummary] = await Promise.all([
    api.dashboard.summary(year, month),
    api.transactions.list({ year, month, page: 1, perPage: 5 }),
    api.dashboard.summary(prevYear, prevMonth),
  ])

  const prevTotal = monthlyTotals.find((m: any) => {
    return m.year === prevYear && m.month === prevMonth
  })?.total ?? 0

  const delta = Number(summary.totalSpent) - prevTotal
  const biggestCat = summary.biggestCategory

  // Find category with biggest absolute change vs prev month
  const prevByCat: any[] = prevSummary.byCategory ?? []
  const biggestDriver = byCategory.reduce<{ name: string; color: string; delta: number } | null>((best, cat) => {
    const prev = prevByCat.find((p: any) => p.categoryId === cat.categoryId)?.total ?? 0
    const d = Math.abs(Number(cat.total) - prev)
    if (!best || d > best.delta) return { name: cat.name, color: cat.color, delta: d }
    return best
  }, null)

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy')
  const isEmpty = summary.transactionCount === 0

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--text)' }}>{monthLabel}</h1>
        <Link href={`/dashboard?year=${prevYear}&month=${prevMonth}`}
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ChevronLeft size={16} style={{ color: 'var(--text-2)' }} />
        </Link>
        <Link href={`/dashboard?year=${nextYear}&month=${nextMonth}`}
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ChevronRight size={16} style={{ color: 'var(--text-2)' }} />
        </Link>
      </div>

      {isEmpty ? (
        <EmptyDashboard monthLabel={monthLabel} year={year} month={month} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Spent this month</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
                <CurrencyAmount amount={Number(summary.totalSpent)} />
              </p>
              {prevTotal > 0 && (
                <p className="text-xs mt-1" style={{ color: delta > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {delta > 0 ? '▲' : '▼'} <CurrencyAmount amount={Math.abs(delta)} fractionDigits={0} /> vs last month
                </p>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Biggest category</p>
              {biggestCat ? (
                <>
                  <p className="text-xl font-bold mb-0.5" style={{ color: 'var(--text)' }}>{biggestCat.name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                    <CurrencyAmount amount={Number(biggestCat.total)} /> · {summary.totalSpent > 0
                      ? Math.round((biggestCat.total / summary.totalSpent) * 100) : 0}% of total
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--text-3)' }} className="text-sm">No data</p>
              )}
            </Card>
            <Card>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Transactions</p>
              <p className="text-3xl font-bold mb-1" style={{ color: 'var(--text)' }}>{summary.transactionCount}</p>
              {summary.inboxCount > 0 && (
                <Link href="/import/inbox" className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {summary.inboxCount} in inbox →
                </Link>
              )}
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card>
              <SpendingSection
                data={byCategory}
                grandTotal={Number(summary.totalSpent)}
                totalIncome={Number(summary.totalIncome ?? 0)}
                year={year}
                month={month}
              />
            </Card>
            <Card>
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Last 4 months</h2>
              {/* Delta callout */}
              {prevTotal > 0 && delta !== 0 && (
                <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
                  <span style={{ color: delta > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                    {delta > 0 ? '▲' : '▼'} <CurrencyAmount amount={Math.abs(delta)} fractionDigits={0} />
                  </span>
                  {' '}vs last month
                  {biggestDriver && (
                    <> · <span style={{ color: 'var(--text)' }}>{biggestDriver.name}</span>
                    {' '}{biggestDriver.delta > 0 ? 'up' : 'down'} <CurrencyAmount amount={Math.abs(biggestDriver.delta)} fractionDigits={0} /></>
                  )}
                </p>
              )}
              <MonthComparisonChart
                data={monthlyTotals}
                currentYear={year}
                currentMonth={month}
                prevMonthTotal={prevTotal}
                biggestCategoryName={biggestDriver?.name}
              />
            </Card>
          </div>

          {/* Recent transactions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent transactions</h2>
              <Link
                href={`/transactions?year=${year}&month=${month}`}
                className="text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                View all →
              </Link>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {recentTxs.map((tx: any) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: 'var(--text-2)', width: 80 }}>
                      {format(new Date(tx.date), 'd MMM')}
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--text)' }}>{tx.description}</td>
                    <td className="py-3 pr-4">
                      {tx.category
                        ? <CategoryPill name={tx.category.name} color={tx.category.color} />
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums" style={{ color: 'var(--text)' }}>
                      <CurrencyAmount amount={Math.abs(Number(tx.amount))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
