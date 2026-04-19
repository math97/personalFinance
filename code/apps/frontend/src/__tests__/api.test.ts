import { describe, it, expect, vi, beforeEach } from 'vitest'

function mockFetch(ok: boolean, body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('api.transactions.list', () => {
  it('includes year and month in query string', async () => {
    mockFetch(true, { items: [], total: 0, page: 1, perPage: 10, totalPages: 0 })
    const { api } = await import('@/lib/api')

    await api.transactions.list({ year: 2024, month: 3 })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('year=2024')
    expect(calledUrl).toContain('month=3')
  })

  it('omits undefined params from query string', async () => {
    mockFetch(true, { items: [], total: 0, page: 1, perPage: 10, totalPages: 0 })
    const { api } = await import('@/lib/api')

    await api.transactions.list({ year: 2024, month: 1 })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).not.toContain('search')
    expect(calledUrl).not.toContain('categoryId')
  })
})

describe('api error handling', () => {
  it('throws on non-ok response', async () => {
    mockFetch(false, null, 500)
    const { api } = await import('@/lib/api')

    await expect(api.categories.list()).rejects.toThrow('500')
  })

  it('throws with path info in error message', async () => {
    mockFetch(false, null, 404)
    const { api } = await import('@/lib/api')

    await expect(api.categories.list()).rejects.toThrow('/categories')
  })
})

describe('api.categories', () => {
  it('returns parsed JSON on success', async () => {
    const cats = [{ id: '1', name: 'Groceries', color: '#ff0000' }]
    mockFetch(true, cats)
    const { api } = await import('@/lib/api')

    const result = await api.categories.list()
    expect(result).toEqual(cats)
  })
})
