import axios from 'axios'
import { create } from 'zustand'
import {
  clearStoredPlatformAuth,
  getPlatformAccessToken,
  getPlatformRefreshToken,
  getStoredPlatformAdmin,
  platformLogin,
  platformLogout,
  setPlatformSessionEndedHandler,
  storePlatformSession,
  type PlatformAdmin,
} from '../lib/api'

interface PlatformAuthState {
  accessToken: string | null
  refreshToken: string | null
  admin: PlatformAdmin | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

/**
 * Never say whether an address exists — a wrong password and an unknown
 * operator must be indistinguishable here.
 */
function loginErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return 'Sign-in failed. Please try again.'
  }
  const status = err.response?.status
  if (status === 429) {
    const retryAfter = Number(err.response?.headers?.['retry-after'])
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? `Too many failed attempts. Try again in ${retryAfter}s.`
      : 'Too many failed attempts. Try again later.'
  }
  if (status === 401 || status === 403) {
    return 'Invalid email or password.'
  }
  if (!err.response) {
    return 'Cannot reach the platform API. Check your connection.'
  }
  return 'Sign-in failed. Please try again.'
}

export const usePlatformAuthStore = create<PlatformAuthState>()((set, get) => ({
  accessToken: getPlatformAccessToken(),
  refreshToken: getPlatformRefreshToken(),
  admin: getStoredPlatformAdmin(),
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await platformLogin(email, password)
      const admin: PlatformAdmin = {
        id: data.admin_id,
        email: data.email,
        full_name: data.full_name,
        is_active: true,
      }
      storePlatformSession(data.access_token, data.refresh_token, admin)
      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        admin,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false, error: loginErrorMessage(err) })
      throw err
    }
  },

  logout: async () => {
    const { refreshToken, accessToken } = get()
    try {
      if (accessToken) {
        await platformLogout(refreshToken)
      }
    } catch {
      // Revoking server-side is best effort; the local session goes either way.
    }
    clearStoredPlatformAuth()
    set({ accessToken: null, refreshToken: null, admin: null })
  },
}))

// Unmount protected routes as soon as api.ts gives up on the session, so the
// router redirects instead of the queue refetching against a dead token.
setPlatformSessionEndedHandler(() => {
  usePlatformAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    admin: null,
  })
})
