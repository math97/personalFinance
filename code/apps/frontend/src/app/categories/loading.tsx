export default function CategoriesLoading() {
  return (
    <div className="px-8 py-6 max-w-3xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-32 rounded-lg" style={{ background: 'var(--surface-2)' }} />
        <div className="h-9 w-32 rounded-lg" style={{ background: 'var(--surface-2)' }} />
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-4"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 flex-1 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-16 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-3 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
