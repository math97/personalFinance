const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`)
  return res.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API PATCH ${path} → ${res.status}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API DELETE ${path} → ${res.status}`)
  return res.json()
}

// ── Dashboard ─────────────────────────────────────────────
export const api = {
  dashboard: {
    summary: (year: number, month: number) =>
      get<{ summary: any; byCategory: any[]; monthlyTotals: any[] }>('/dashboard/summary', { year, month }),
  },

  transactions: {
    list: (params: { year?: number; month?: number; search?: string; categoryId?: string; page?: number; perPage?: number }) =>
      get<{ items: any[]; total: number; page: number; perPage: number; totalPages: number }>('/transactions', params as any),
    create: (data: { amount: number; date: string; description: string; categoryId?: string; source?: string }) =>
      post<any>('/transactions', data),
    update: (id: string, data: Partial<{ amount: number; date: string; description: string; categoryId: string }>) =>
      patch<any>(`/transactions/${id}`, data),
    remove: (id: string) => del<any>(`/transactions/${id}`),
  },

  categories: {
    list: () => get<any[]>('/categories'),
    create: (data: { name: string; color: string }) => post<any>('/categories', data),
    remove: (id: string) => del<any>(`/categories/${id}`),
    addRule: (categoryId: string, keyword: string) => post<any>(`/categories/${categoryId}/rules`, { keyword }),
    removeRule: (ruleId: string) => del<any>(`/categories/rules/${ruleId}`),
  },

  import: {
    batches: () => get<any[]>('/import/batches'),
    batch: (id: string) => get<any>(`/import/batches/${id}`),
    confirm: (id: string) => post<any>(`/import/batches/${id}/confirm`),
    discard: (id: string) => del<any>(`/import/batches/${id}`),
    updateTransaction: (id: string, data: any) => patch<any>(`/import/transactions/${id}`, data),
    deleteTransaction: (id: string) => del<any>(`/import/transactions/${id}`),
    saveRule: (id: string, keyword: string, categoryId: string) =>
      post<any>(`/import/transactions/${id}/save-rule`, { keyword, categoryId }),
  },
}
