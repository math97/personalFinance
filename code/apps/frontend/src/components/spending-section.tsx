'use client'

import { useState, useEffect } from 'react'
import { SpendingBarChart } from './spending-bar-chart'
import { TERMS } from '@/lib/terminology'

type Row = { name: string; total: number; color: string }

// Single global key — consistent with Settings page
const SALARY_KEY = 'finance_salary'

export function SpendingSection({
  data,
  grandTotal,
  totalIncome = 0,
  year,
  month,
}: {
  data: Row[]
  grandTotal: number
  totalIncome?: number
  year: number
  month: number
}) {
  const LEFTOVER_KEY = `finance_leftover_${year}_${month}`

  const [mode, setMode] = useState<'spending' | 'income'>('spending')

  // Manual salary — global fallback when no income transactions recorded this month
  const [salary, setSalary] = useState(0)
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryInput, setSalaryInput] = useState('0')

  const [leftover, setLeftover] = useState(0)
  const [editingLeftover, setEditingLeftover] = useState(false)
  const [leftoverInput, setLeftoverInput] = useState('0')

  useEffect(() => {
    const stored = localStorage.getItem(SALARY_KEY)
    const val = stored ? Number(stored) : 3500
    setSalary(val)
    setSalaryInput(String(val))
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(LEFTOVER_KEY)
    if (stored) { setLeftover(Number(stored)); setLeftoverInput(stored) }
    else { setLeftover(0); setLeftoverInput('0') }
  }, [year, month])

  function saveSalary() {
    const val = Math.max(0, Number(salaryInput))
    setSalary(val)
    localStorage.setItem(SALARY_KEY, String(val))
    setEditingSalary(false)
  }

  function saveLeftover() {
    const val = Math.max(0, Number(leftoverInput))
    setLeftover(val)
    localStorage.setItem(LEFTOVER_KEY, String(val))
    setEditingLeftover(false)
  }

  const effectiveIncome = totalIncome > 0 ? totalIncome : salary
  const budget = effectiveIncome + leftover

  const incomeData: Row[] = mode === 'income'
    ? [
        { name: totalIncome > 0 ? 'Income' : 'Salary', total: effectiveIncome, color: '#4ade80' },
        { name: TERMS.saved.label, total: leftover, color: '#a78bfa' },
      ]
    : data

  const displayTotal = mode === 'income'
    ? incomeData.reduce((s, r) => s + r.total, 0)
    : grandTotal

  return (
    <SpendingBarChart
      data={incomeData}
      grandTotal={displayTotal}
      mode={mode}
      onModeChange={setMode}
      showSalaryEditor={totalIncome === 0}
      salary={salary}
      budget={budget}
      editingSalary={editingSalary}
      salaryInput={salaryInput}
      onSalaryInputChange={setSalaryInput}
      onEditSalary={() => { setSalaryInput(String(salary)); setEditingSalary(true) }}
      onSaveSalary={saveSalary}
      onCancelSalary={() => setEditingSalary(false)}
      leftover={leftover}
      editingLeftover={editingLeftover}
      leftoverInput={leftoverInput}
      onLeftoverInputChange={setLeftoverInput}
      onEditLeftover={() => { setLeftoverInput(String(leftover)); setEditingLeftover(true) }}
      onSaveLeftover={saveLeftover}
      onCancelLeftover={() => setEditingLeftover(false)}
    />
  )
}
