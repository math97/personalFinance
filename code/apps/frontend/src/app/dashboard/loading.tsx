export default function DashboardLoading() {
  return (
    <div className="px-8 py-6 max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-7 w-36 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        <div className="flex-1" />
        <div className="w-8 h-8 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        <div className="w-8 h-8 rounded-lg" style={{ background: 'var(--surface-2)' }} />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0,1,2].map(i => (
          <div key={i} className="rounded-xl p-5 h-24" style={{ background: 'var(--surface)' }}>
            <div className="h-3 w-24 rounded mb-3" style={{ background: 'var(--surface-2)' }} />
            <div className="h-8 w-32 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[0,1].map(i => (
          <div key={i} className="rounded-xl p-5 h-64" style={{ background: 'var(--surface)' }}>
            <div className="h-4 w-32 rounded mb-4" style={{ background: 'var(--surface-2)' }} />
            <div className="space-y-3">
              {[0,1,2,3,4].map(j => (
                <div key={j} className="h-3 rounded" style={{ background: 'var(--surface-2)', width: `${80 - j * 12}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-5 h-48" style={{ background: 'var(--surface)' }}>
        <div className="h-4 w-40 rounded mb-4" style={{ background: 'var(--surface-2)' }} />
        {[0,1,2].map(i => (
          <div key={i} className="flex gap-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="h-3 w-12 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 flex-1 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-14 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
