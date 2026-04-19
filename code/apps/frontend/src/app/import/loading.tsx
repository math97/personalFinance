export default function ImportLoading() {
  return (
    <div className="px-8 py-6 max-w-2xl mx-auto animate-pulse">
      <div className="h-7 w-36 rounded-lg mb-6" style={{ background: 'var(--surface-2)' }} />
      <div className="rounded-xl h-48 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="h-3 flex-1 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
            <div className="h-7 w-20 rounded-lg" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
