'use client'

import { useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { CloudUpload, FileText, ChevronRight, Loader2, Info } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '@/lib/api'

export default function ImportPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ current: number; total: number; filename: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    api.import.batches().then(setBatches).catch(() => {})
  }, [])

  const onDrop = useCallback(async (accepted: File[]) => {
    setError(null)
    setUploading(true)
    const batchIds: string[] = []
    try {
      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i]
        setUploadStatus({ current: i + 1, total: accepted.length, filename: file.name })
        const { batchId } = await api.import.upload(file)
        batchIds.push(batchId)
      }
      if (batchIds.length === 1) {
        router.push(`/import/${batchIds[0]}`)
      } else {
        router.push('/import/inbox')
      }
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
      setUploading(false)
      setUploadStatus(null)
    }
  }, [router])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: true,
    disabled: uploading,
  })

  return (
    <div className="px-8 py-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Upload Files</h1>

      <div
        {...getRootProps()}
        className="rounded-2xl text-center cursor-pointer transition-all py-16 mb-6"
        style={{
          border: `2px dashed ${isDragActive ? 'var(--accent)' : uploading ? 'var(--border)' : 'var(--border-2)'}`,
          background: isDragActive ? 'var(--accent-dim)' : 'var(--surface)',
          cursor: uploading ? 'default' : 'pointer',
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <>
            <Loader2 size={32} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-base font-medium mb-1" style={{ color: 'var(--text)' }}>
              {uploadStatus
                ? `Extracting transactions… (${uploadStatus.current}/${uploadStatus.total})`
                : 'Extracting transactions…'}
            </p>
            {uploadStatus && (
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{uploadStatus.filename}</p>
            )}
          </>
        ) : (
          <>
            <CloudUpload size={32} className="mx-auto mb-3"
              style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-2)' }} />
            <p className="text-base font-medium mb-1.5" style={{ color: 'var(--text)' }}>
              Drop files here
            </p>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Bank statements — PDF, JPG, PNG, HEIC, CSV
              </p>
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={e => { e.stopPropagation(); setShowTooltip(v => !v) }}
                  style={{ color: 'var(--text-3)', lineHeight: 1 }}
                >
                  <Info size={14} />
                </button>
                {showTooltip && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg px-3 py-2.5 text-left z-10"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      boxShadow: '0 4px 12px #0006',
                    }}
                  >
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
                      Expected CSV format
                    </p>
                    <code
                      className="text-xs block mb-1.5 px-2 py-1 rounded"
                      style={{ background: 'var(--surface)', color: 'var(--accent)', fontFamily: 'monospace' }}
                    >
                      date,description,amount
                    </code>
                    <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-2)' }}>
                      <li>• date: YYYY-MM-DD or DD/MM/YYYY</li>
                      <li>• amount: negative for expenses</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <button className="inline-flex px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
              Browse files
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm mb-4" style={{ color: 'var(--red)' }}>{error}</p>}

      {batches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-2)' }}>PENDING REVIEW</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {batches.map((batch: any, i: number) => (
              <Link key={batch.id} href={`/import/${batch.id}`}
                className="flex items-center gap-4 px-5 py-4"
                style={{ background: 'var(--surface)', borderBottom: i < batches.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <FileText size={18} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{batch.filename}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                    {batch._count?.imported ?? 0} transactions · {format(new Date(batch.uploadedAt), 'd MMM yyyy')}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  Review
                </span>
                <ChevronRight size={14} style={{ color: 'var(--text-2)' }} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
