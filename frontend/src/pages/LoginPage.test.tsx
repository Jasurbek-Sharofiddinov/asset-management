import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

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
})
