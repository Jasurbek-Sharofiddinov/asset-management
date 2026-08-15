import { create } from 'zustand'
import { authApi, clearStoredAuth, setSessionEndedHandler } from '../lib/api'
import type { User } from '../types'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string, organizationSlug?: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  loadUser: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refresh_token'),
  user: (() => {
    try {
      const u = localStorage.getItem('user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })(),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string, organizationSlug?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login(email, password, organizationSlug)
      const token = response.access_token
      const refreshToken = response.refresh_token
      const user = {
        id: response.user_id,
        email: response.email || email,
        full_name: response.full_name,
        role: response.role,
        is_active: true,
        must_change_password: Boolean(response.must_change_password),
      }
      localStorage.setItem('token', token)
      localStorage.setItem('refresh_token', refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
      set({ token, refreshToken, user, isAuthenticated: true, isLoading: false })
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: any) => d.msg || String(d)).join(', ')
            : 'Login failed. Please check your credentials.'
      set({ error: message, isLoading: false, isAuthenticated: false })
      throw err
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    try {
      await authApi.logout(refreshToken)
    } catch {
      // Ignore logout API errors
    } finally {
      clearStoredAuth()
      set({ token: null, refreshToken: null, user: null, isAuthenticated: false })
    }
  },

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },

  loadUser: async () => {
    try {
      const user = await authApi.me()
      localStorage.setItem('user', JSON.stringify(user))
      set({ user })
    } catch {
      // If user fetch fails, don't break auth
    }
  },

  clearError: () => set({ error: null }),
}))

// Unmount protected routes as soon as api.ts gives up on the session, so the
// router redirects instead of the dashboard refetching against a dead token.
setSessionEndedHandler(() => {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
  })
})
