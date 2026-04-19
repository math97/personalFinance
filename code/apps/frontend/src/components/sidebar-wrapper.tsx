'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { TransactionModal } from './transaction-modal'

export function SidebarWrapper() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <Sidebar onAddClick={() => setModalOpen(true)} />
      {modalOpen && <TransactionModal onClose={() => setModalOpen(false)} />}
    </>
  )
}
