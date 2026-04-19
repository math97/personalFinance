'use client'

import { useState, useEffect } from 'react'
import { SpendingBarChart } from './spending-bar-chart'

type Row = { name: string; total: number; color: string }

const GLOBAL_SALARY_KEY = 'finance_salary'

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
  const SALARY_KEY = `finance_salary_${year}_${month}`
  const LEFTOVER_KEY = `finance_leftover_${year}_${month}`

  const [mode, setMode] = useState<'spending' | 'income'>('spending')

  // Manual salary — only used as fallback when no income transactions exist
  const [salary, setSalary] = useState(0)
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryInput, setSalaryInput] = useState('0')

  const [leftover, setLeftover] = useState(0)
  const [editingLeftover, setEditingLeftover] = useState(false)
  const [leftoverInput, setLeftoverInput] = useState('0')

  useEffect(() => {
    const stored = localStorage.getItem(SALARY_KEY) ?? localStorage.getItem(GLOBAL_SALARY_KEY)
    const val = stored ? Number(stored) : 3500
    setSalary(val)
    setSalaryInput(String(val))
  }, [SALARY_KEY])

  useEffect(() => {
    const stored = localStorage.getItem(LEFTOVER_KEY)
    if (stored) { setLeftover(Number(stored)); setLeftoverInput(stored) }
    else { setLeftover(0); setLeftoverInput('0') }
  }, [LEFTOVER_KEY])

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

  // If income transactions exist for this month, use them as income source.
  // Only fall back to manual salary when there are no income transactions yet.
  const effectiveIncome = totalIncome > 0 ? totalIncome : salary
  const budget = effectiveIncome + leftover

  const incomeData: Row[] = mode === 'income'
    ? [
        { name: totalIncome > 0 ? 'Income' : 'Salary', total: effectiveIncome, color: '#4ade80' },
        { name: 'Leftover', total: leftover, color: '#a78bfa' },
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
      // Only show manual salary editor when no income transactions
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
