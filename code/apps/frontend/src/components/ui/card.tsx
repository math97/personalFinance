import { cn } from '@/lib/cn'

interface CardProps extends React.ComponentProps<'div'> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-xl p-5 bg-surface border border-border', className)}
      {...props}
    >
      {children}
    </div>
  )
}
