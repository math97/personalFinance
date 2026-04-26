export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-7 w-40 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        <div className="flex-1" />
        <div className="w-8 h-8 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        <div className="w-28 h-5 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        <div className="w-8 h-8 rounded-lg" style={{ background: 'var(--surface-2)' }} />
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h-8 flex-1 rounded-lg" style={{ background: 'var(--surface-2)' }} />
          <div className="h-8 w-36 rounded-lg" style={{ background: 'var(--surface-2)' }} />
          <div className="h-8 w-28 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        </div>
        <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h-3 w-64 rounded" style={{ background: 'var(--surface-2)' }} />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 flex-1 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-5 w-24 rounded-full" style={{ background: 'var(--surface-2)' }} />
            <div className="h-5 w-14 rounded-full" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-16 rounded ml-auto" style={{ background: 'var(--surface-2)' }} />
            <div className="h-7 w-7 rounded-md" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
        <div className="flex justify-between px-5 py-3">
          <div className="h-3 w-32 rounded" style={{ background: 'var(--surface-2)' }} />
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-7 w-7 rounded-md" style={{ background: 'var(--surface-2)' }} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
