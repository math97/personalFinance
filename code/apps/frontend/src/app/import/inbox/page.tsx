import Link from 'next/link'
import { FileText, ChevronRight, Inbox } from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'

export default async function ImportInboxPage() {
  const batches = await api.import.batches()

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Import Inbox</h1>
        {batches.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: '#0c0c0e' }}>
            {batches.length}
          </span>
        )}
      </div>

      {batches.length === 0 ? (
        <div className="rounded-xl flex flex-col items-center justify-center py-20"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Inbox size={36} className="mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>Inbox is empty</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>Upload a document to extract transactions</p>
          <Link href="/import" className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0c0c0e' }}>
            Upload files →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {batches.map((batch: any, i: number) => (
            <Link key={batch.id} href={`/import/${batch.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors"
              style={{ background: 'var(--surface)', borderBottom: i < batches.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: 'var(--surface-2)' }}>
                <FileText size={16} style={{ color: 'var(--text-2)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{batch.filename}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                  {batch._count?.imported ?? batch.imported?.length ?? '?'} transactions · {format(new Date(batch.uploadedAt), 'd MMM yyyy')}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                Reviewing
              </span>
              <ChevronRight size={14} style={{ color: 'var(--text-2)' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
