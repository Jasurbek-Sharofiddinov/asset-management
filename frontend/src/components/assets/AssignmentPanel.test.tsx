import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssignmentPanel } from './AssignmentPanel'
import { ToastProvider } from '../ui/Toast'
import type { Asset } from '../../types'

vi.mock('../../lib/api', () => ({
  referenceApi: {
    getEmployees: vi.fn().mockResolvedValue([]),
    getDepartments: vi.fn().mockResolvedValue([]),
    getBranches: vi.fn().mockResolvedValue([{ id: 'branch-1', name: 'Head Office' }]),
  },
  assignmentsApi: {
    assignAsset: vi.fn(),
    returnAsset: vi.fn(),
  },
}))

const asset: Asset = {
  id: 'asset-1',
  name: 'Dell Monitor',
  asset_type: 'Monitor',
  serial_number: 'SN-1',
  category: 'IT',
  status: 'REGISTERED',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AssignmentPanel isOpen onClose={() => {}} asset={asset} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('AssignmentPanel', () => {
  it('shows a validation error when submitting without a branch', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /^assign$/i }))

    expect(await screen.findByText('Branch is required')).toBeInTheDocument()
  })
})
