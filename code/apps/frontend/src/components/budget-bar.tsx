type BudgetBarProps = {
  spent: number
  budget: number
  color: string
}

export function BudgetBar({ spent, budget, color }: BudgetBarProps) {
  const pct = Math.min(Math.round((spent / budget) * 100), 100)
  const isOver = spent > budget
  const fillColor  = isOver ? 'var(--red)' : color
  const trackColor = isOver ? '#f8717120' : 'var(--surface-2)'

  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: trackColor }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: fillColor }}
      />
    </div>
  )
}
