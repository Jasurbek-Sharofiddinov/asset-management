import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'
import * as config from '../lib/config'
import { authApi } from '../lib/api'

const login = vi.fn()
const clearError = vi.fn()

vi.mock('../stores/authStore', () => {
  const useAuthStore = Object.assign(
    () => ({
      login,
      isLoading: false,
      error: null as string | null,
      clearError,
    }),
    {
      getState: () => ({ user: { must_change_password: false } }),
    },
  )
  return { useAuthStore }
})

describe('LoginPage organization slug', () => {
  beforeEach(() => {
    login.mockReset()
    clearError.mockReset()
    vi.restoreAllMocks()
  })

  it('shows the slug field after a 400 mentioning organization_slug and submits it', async () => {
    const user = userEvent.setup()
    login.mockImplementation(async (_email: string, _password: string, slug?: string) => {
      if (!slug) {
        const err = Object.assign(new Error('Bad Request'), {
          response: {
            data: { detail: 'Provide organization_slug to continue.' },
            status: 400,
          },
        })
        throw err
      }
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Email address'), 'shared@test.uz')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'SecretPass1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const slugInput = await screen.findByLabelText(/organization slug/i)
    expect(slugInput).toBeInTheDocument()

    await user.type(slugInput, 'test-bank')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(login).toHaveBeenLastCalledWith('shared@test.uz', 'SecretPass1', 'test-bank')
  })

  it('finder mode asks for a workspace instead of a password', () => {
    vi.spyOn(config, 'loginMode').mockReturnValue('finder')
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /find your workspace/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Workspace')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Enter your password')).not.toBeInTheDocument()
  })

  it('shows a missing-workspace message when tenant lookup fails', async () => {
    vi.spyOn(config, 'loginMode').mockReturnValue('tenant')
    vi.spyOn(config, 'tenantSlugFromHost').mockReturnValue('nope')
    vi.spyOn(config, 'isDemoHost').mockReturnValue(false)
    vi.spyOn(authApi, 'getTenant').mockRejectedValue(new Error('not found'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/this workspace does not exist/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Enter your password')).not.toBeInTheDocument()
  })

  it('shows the password form after a tenant host is confirmed', async () => {
    vi.spyOn(config, 'loginMode').mockReturnValue('tenant')
    vi.spyOn(config, 'tenantSlugFromHost').mockReturnValue('acme')
    vi.spyOn(config, 'isDemoHost').mockReturnValue(false)
    vi.spyOn(authApi, 'getTenant').mockResolvedValue({ slug: 'acme', name: 'Acme Bank' })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(await screen.findByPlaceholderText('Enter your password')).toBeInTheDocument()
    expect(screen.getByText(/sign in to acme bank/i)).toBeInTheDocument()
  })
})
