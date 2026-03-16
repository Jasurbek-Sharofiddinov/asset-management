import { create } from 'zustand'
import { authApi } from '../lib/api'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  loadUser: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
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

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login(email, password)
      const token = response.access_token
      const user = {
        id: response.user_id,
        email: email,
        full_name: response.full_name,
        role: response.role,
        is_active: true,
      }
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      set({ token, user, isAuthenticated: true, isLoading: false })
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Login failed. Please check your credentials.'
      set({ error: message, isLoading: false, isAuthenticated: false })
      throw err
    }
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore logout API errors
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      set({ token: null, user: null, isAuthenticated: false })
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
