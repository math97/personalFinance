export default function InboxLoading() {
  return (
    <div className="px-8 py-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-7 w-32 rounded-lg mb-6" style={{ background: 'var(--surface-2)' }} />
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[0,1,2].map(i => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="w-9 h-9 rounded-lg" style={{ background: 'var(--surface-2)' }} />
            <div className="flex-1">
              <div className="h-3 w-48 rounded mb-2" style={{ background: 'var(--surface-2)' }} />
              <div className="h-2.5 w-32 rounded" style={{ background: 'var(--surface-2)' }} />
            </div>
            <div className="h-6 w-16 rounded-full" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
