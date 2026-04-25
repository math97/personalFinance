import { Calendar } from 'lucide-react'
import { CurrencyAmount } from './currency-amount'

type UpcomingItem = {
  patternId: string
  description: string
  typicalAmount: number
  expectedDay: number
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

type Props = {
  items: UpcomingItem[]
  currentMonthLabel: string
}

export function UpcomingPanel({ items, currentMonthLabel }: Props) {
  if (items.length === 0) return null

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Upcoming this month
          </span>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-md"
          style={{ background: 'var(--accent)' + '18', color: 'var(--accent)' }}
        >
          {items.length} expected
        </span>
      </div>

      {items.map((item, i) => (
        <div
          key={item.patternId}
          className="flex items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: item.categoryColor ?? 'var(--text-3)' }}
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block" style={{ color: 'var(--text)' }}>
              {item.description}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>
              Expected ~{currentMonthLabel} {item.expectedDay}
              {item.categoryName && ` · ${item.categoryName}`}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
            −<CurrencyAmount amount={Math.abs(item.typicalAmount)} />
          </span>
        </div>
      ))}
    </div>
  )
}
