'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'

export default function SettingsPage() {
  const [salary, setSalary] = useState(3500)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('finance_salary')
    if (stored) setSalary(Number(stored))
  }, [])

  function save() {
    localStorage.setItem('finance_salary', String(salary))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="px-8 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Settings</h1>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Section header */}
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <p className="text-xs font-semibold tracking-wider" style={{ color: 'var(--text-3)' }}>INCOME</p>
        </div>

        {/* Salary row */}
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Monthly salary</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                Used in the spending chart to calculate % of income spent
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="flex items-center gap-1 rounded-lg px-3 py-2"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-2)' }}>£</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={salary}
                  onChange={e => setSalary(Number(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  className="bg-transparent text-sm outline-none w-24 text-right"
                  style={{ color: 'var(--text)' }}
                />
              </div>
              <button
                onClick={save}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: saved ? '#16a34a22' : 'var(--accent)',
                  color: saved ? '#16a34a' : '#0c0c0e',
                }}
              >
                {saved ? <><Check size={14} /> Saved</> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
