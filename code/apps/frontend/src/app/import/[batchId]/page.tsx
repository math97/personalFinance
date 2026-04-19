import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { BatchReviewClient } from '@/components/batch-review-client'

export default async function BatchReviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params

  try {
    const [batch, categories] = await Promise.all([
      api.import.batch(batchId),
      api.categories.list(),
    ])
    return <BatchReviewClient batch={batch} categories={categories} />
  } catch {
    notFound()
  }
}
