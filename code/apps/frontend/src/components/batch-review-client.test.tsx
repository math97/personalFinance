import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import { BatchReviewClient } from './batch-review-client'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockPush, mockApi } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockApi = {
    import: {
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      saveRule: vi.fn(),
      confirm: vi.fn(),
      discard: vi.fn(),
    },
  }
  return { mockPush, mockApi }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))

vi.mock('@/lib/api', () => ({ api: mockApi }))

// ── Fixtures ───────────────────────────────────────────────────────────────

const CAT_ENTERTAINMENT = { id: 'cat-1', name: 'Entertainment', color: '#6366f1' }
const CAT_FOOD = { id: 'cat-2', name: 'Food', color: '#10b981' }

const ITEM_CATEGORIZED = {
  id: 'tx-1',
  rawDate: '2026-04-15',
  rawDescription: 'Netflix subscription',
  rawAmount: -12.99,
  aiCategorized: true,
  aiCategory: CAT_ENTERTAINMENT,
}

const ITEM_UNCATEGORIZED = {
  id: 'tx-2',
  rawDate: '2026-04-10',
  rawDescription: 'Unknown Merchant',
  rawAmount: -50,
  aiCategorized: false,
  aiCategory: null,
}

const ITEM_INCOME = {
  id: 'tx-3',
  rawDate: '2026-04-01',
  rawDescription: 'Salary payment',
  rawAmount: 3000,
  aiCategorized: true,
  aiCategory: null,
}

const BATCH = { id: 'batch-1', filename: 'bank.pdf', imported: [ITEM_CATEGORIZED, ITEM_UNCATEGORIZED] }
const CATEGORIES = [CAT_ENTERTAINMENT, CAT_FOOD]

function renderComponent(batch = BATCH, categories = CATEGORIES) {
  return render(<BatchReviewClient batch={batch} categories={categories} />)
}

// Row structure (non-editing): [toggle-button, pencil-button, trash-button]
// Row structure (editing):     [save-button]
function getRowButtons(description: string) {
  const rowEl = screen.getByText(description).closest('.grid.items-center') as HTMLElement
  return within(rowEl).getAllByRole('button')
}

function getEditingRowButtons() {
  // In edit mode description is an input — find save button via the editing row
  const inputs = screen.getAllByRole('textbox')
  const rowEl = inputs[0].closest('.grid.items-center') as HTMLElement
  return within(rowEl).getAllByRole('button')
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.import.updateTransaction.mockResolvedValue({})
  mockApi.import.deleteTransaction.mockResolvedValue({})
  mockApi.import.saveRule.mockResolvedValue({})
  mockApi.import.confirm.mockResolvedValue({})
  mockApi.import.discard.mockResolvedValue({})
})

describe('BatchReviewClient', () => {
  describe('rendering', () => {
    it('shows the batch filename in the header', () => {
      renderComponent()
      expect(screen.getByText('bank.pdf')).toBeInTheDocument()
    })

    it('renders all imported transactions', () => {
      renderComponent()
      expect(screen.getByText('Netflix subscription')).toBeInTheDocument()
      expect(screen.getByText('Unknown Merchant')).toBeInTheDocument()
    })

    it('shows correct uncategorized count', () => {
      renderComponent()
      expect(screen.getByText(/1 need categorization/)).toBeInTheDocument()
    })

    it('shows "all categorized" when no uncategorized items', () => {
      renderComponent({ ...BATCH, imported: [ITEM_CATEGORIZED] })
      expect(screen.getByText(/all categorized/)).toBeInTheDocument()
    })

    it('shows income label for positive amounts', () => {
      renderComponent({ ...BATCH, imported: [ITEM_INCOME] })
      expect(screen.getByText('Income')).toBeInTheDocument()
    })

    it('shows confirm button with correct item count', () => {
      renderComponent()
      expect(screen.getByRole('button', { name: /confirm all 2/i })).toBeInTheDocument()
    })
  })

  describe('inline editing', () => {
    it('enters edit mode when pencil button is clicked', async () => {
      renderComponent()
      // row buttons: [toggle(0), pencil(1), trash(2)]
      const [, pencil] = getRowButtons('Netflix subscription')
      fireEvent.click(pencil)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Netflix subscription')).toBeInTheDocument()
      })
    })

    it('saves edit and calls updateTransaction with new description', async () => {
      renderComponent()
      const [, pencil] = getRowButtons('Netflix subscription')
      fireEvent.click(pencil)

      await waitFor(() => screen.getByDisplayValue('Netflix subscription'))

      fireEvent.change(screen.getByDisplayValue('Netflix subscription'), {
        target: { value: 'Netflix updated' },
      })

      const [save] = getEditingRowButtons()
      fireEvent.click(save)

      await waitFor(() => {
        expect(mockApi.import.updateTransaction).toHaveBeenCalledWith(
          'tx-1',
          expect.objectContaining({ rawDescription: 'Netflix updated' }),
        )
      })
    })

    it('exits edit mode after saving', async () => {
      renderComponent()
      const [, pencil] = getRowButtons('Netflix subscription')
      fireEvent.click(pencil)

      await waitFor(() => screen.getByDisplayValue('Netflix subscription'))
      const [save] = getEditingRowButtons()
      fireEvent.click(save)

      await waitFor(() => {
        expect(screen.queryByDisplayValue('Netflix subscription')).not.toBeInTheDocument()
      })
    })

    it('saves amount as negative for expense', async () => {
      renderComponent()
      const [, pencil] = getRowButtons('Netflix subscription')
      fireEvent.click(pencil)

      await waitFor(() => screen.getByDisplayValue('12.99'))

      fireEvent.change(screen.getByDisplayValue('12.99'), { target: { value: '20' } })
      const [save] = getEditingRowButtons()
      fireEvent.click(save)

      await waitFor(() => {
        expect(mockApi.import.updateTransaction).toHaveBeenCalledWith(
          'tx-1',
          expect.objectContaining({ rawAmount: -20 }),
        )
      })
    })
  })

  describe('save-rule prompt', () => {
    async function triggerSaveRulePrompt() {
      renderComponent()
      const [, pencil] = getRowButtons('Unknown Merchant')
      fireEvent.click(pencil)

      await waitFor(() => screen.getByDisplayValue('Unknown Merchant'))

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: CAT_FOOD.id } })

      const [save] = getEditingRowButtons()
      fireEvent.click(save)

      await waitFor(() => screen.getByText(/always categorize/i))
    }

    it('shows save-rule prompt when uncategorized item gets a category', async () => {
      await triggerSaveRulePrompt()
      const prompt = screen.getByText(/always categorize/i).closest('div') as HTMLElement
      expect(prompt).toBeInTheDocument()
      expect(within(prompt).getByText('Food')).toBeInTheDocument()
    })

    it('does not show prompt for already-categorized items', async () => {
      renderComponent()
      const [, pencil] = getRowButtons('Netflix subscription')
      fireEvent.click(pencil)

      await waitFor(() => screen.getByDisplayValue('Netflix subscription'))
      const [save] = getEditingRowButtons()
      fireEvent.click(save)

      await waitFor(() => {
        expect(screen.queryByText(/always categorize/i)).not.toBeInTheDocument()
      })
    })

    it('calls saveRule API with correct args and dismisses prompt', async () => {
      await triggerSaveRulePrompt()

      fireEvent.click(screen.getByRole('button', { name: /save rule/i }))

      await waitFor(() => {
        expect(mockApi.import.saveRule).toHaveBeenCalledWith('tx-2', 'unknown', CAT_FOOD.id)
        expect(screen.queryByText(/always categorize/i)).not.toBeInTheDocument()
      })
    })

    it('dismisses prompt when X is clicked without saving rule', async () => {
      await triggerSaveRulePrompt()

      const saveRuleBtn = screen.getByRole('button', { name: /save rule/i })
      fireEvent.click(saveRuleBtn.nextElementSibling as HTMLElement)

      await waitFor(() => {
        expect(mockApi.import.saveRule).not.toHaveBeenCalled()
        expect(screen.queryByText(/always categorize/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('deleteItem', () => {
    it('removes item after confirm dialog is accepted', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderComponent()

      const [, , trash] = getRowButtons('Netflix subscription')
      fireEvent.click(trash)

      await waitFor(() => {
        expect(mockApi.import.deleteTransaction).toHaveBeenCalledWith('tx-1')
        expect(screen.queryByText('Netflix subscription')).not.toBeInTheDocument()
      })
    })

    it('does not remove item if confirm is cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderComponent()

      const [, , trash] = getRowButtons('Netflix subscription')
      fireEvent.click(trash)

      expect(mockApi.import.deleteTransaction).not.toHaveBeenCalled()
      expect(screen.getByText('Netflix subscription')).toBeInTheDocument()
    })
  })

  describe('toggleIncome', () => {
    it('flips expense to income', async () => {
      renderComponent()

      // Scope to the Netflix row to avoid ambiguity with the second expense row
      const [toggleBtn] = getRowButtons('Netflix subscription')
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(mockApi.import.updateTransaction).toHaveBeenCalledWith(
          'tx-1',
          expect.objectContaining({ rawAmount: 12.99 }),
        )
      })
    })

    it('flips income to expense', async () => {
      renderComponent({ ...BATCH, imported: [ITEM_INCOME] })

      fireEvent.click(screen.getByTitle('Mark as expense'))

      await waitFor(() => {
        expect(mockApi.import.updateTransaction).toHaveBeenCalledWith(
          'tx-3',
          expect.objectContaining({ rawAmount: -3000 }),
        )
      })
    })
  })

  describe('handleConfirm', () => {
    it('calls confirm API and navigates to /import/inbox', async () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /confirm all/i }))

      await waitFor(() => {
        expect(mockApi.import.confirm).toHaveBeenCalledWith('batch-1')
        expect(mockPush).toHaveBeenCalledWith('/import/inbox')
      })
    })

    it('disables both action buttons while loading', async () => {
      mockApi.import.confirm.mockReturnValue(new Promise(() => {}))
      renderComponent()

      fireEvent.click(screen.getByRole('button', { name: /confirm all/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm all/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /discard/i })).toBeDisabled()
      })
    })
  })

  describe('handleDiscard', () => {
    it('calls discard API and navigates to /import/inbox', async () => {
      renderComponent()
      fireEvent.click(screen.getByRole('button', { name: /discard/i }))

      await waitFor(() => {
        expect(mockApi.import.discard).toHaveBeenCalledWith('batch-1')
        expect(mockPush).toHaveBeenCalledWith('/import/inbox')
      })
    })
  })
})
