export default function InsightsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded-lg mb-1" style={{ background: 'var(--surface-2)' }} />
          <div className="h-4 w-56 rounded-lg"         style={{ background: 'var(--surface-2)' }} />
        </div>
        <div className="h-8 w-40 rounded-lg"           style={{ background: 'var(--surface-2)' }} />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="w-2 h-2 rounded-full"    style={{ background: 'var(--surface-2)', flexShrink: 0 }} />
            <div className="h-4 w-28 rounded"        style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-16 rounded ml-auto" style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-16 rounded"        style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 w-16 rounded"        style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>

      {/* Chat skeleton */}
      <div className="h-32 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
    </div>
  )
}
