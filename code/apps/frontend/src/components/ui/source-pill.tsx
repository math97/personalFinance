import { cn } from '@/lib/cn'

type Source = 'manual' | 'pdf' | 'photo' | 'csv'

const styles: Record<Source, { bg: string; color: string; label: string }> = {
  manual: { bg: '#ffffff10', color: '#71717a', label: 'manual' },
  pdf:    { bg: '#38bdf822', color: '#38bdf8', label: 'pdf'    },
  photo:  { bg: '#c084fc22', color: '#c084fc', label: 'photo'  },
  csv:    { bg: '#34d39922', color: '#34d399', label: 'csv'    },
}

interface SourcePillProps extends React.ComponentProps<'span'> {
  source: Source
}

export function SourcePill({ source, className, ...props }: SourcePillProps) {
  const s = styles[source] ?? styles.manual
  return (
    <span
      className={cn('text-xs px-2 py-0.5 rounded-full font-medium', className)}
      style={{ background: s.bg, color: s.color }}
      {...props}
    >
      {s.label}
    </span>
  )
}
