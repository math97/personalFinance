import { cn } from '@/lib/cn'

interface CategoryPillProps extends React.ComponentProps<'span'> {
  name: string
  color: string
}

export function CategoryPill({ name, color, className, ...props }: CategoryPillProps) {
  return (
    <span
      className={cn('text-xs px-2 py-0.5 rounded-full font-medium', className)}
      style={{ background: color + '22', color }}
      {...props}
    >
      {name}
    </span>
  )
}
