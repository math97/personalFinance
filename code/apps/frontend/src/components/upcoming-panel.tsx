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
    <div className="rounded-xl overflow-hidden bg-surface border border-border">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-accent" />
          <span className="text-sm font-semibold text-text">
            Upcoming this month
          </span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-accent-dim text-accent">
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
            <span className="text-sm font-medium truncate block text-text">
              {item.description}
            </span>
            <span className="text-xs text-text-2">
              Expected ~{currentMonthLabel} {item.expectedDay}
              {item.categoryName && ` · ${item.categoryName}`}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0 text-accent">
            −<CurrencyAmount amount={Math.abs(item.typicalAmount)} />
          </span>
        </div>
      ))}
    </div>
  )
}
